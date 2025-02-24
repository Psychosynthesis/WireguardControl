## Пример настройки корпративного VPN
В данном примере мы настроим корпоративную сеть с помощью Wireguard в которой клиенты будут подключаться к основному серверу, а сервер будет пересылать пакеты на выходной узел. В конце мы добавим получение ip-адресов зоны `.ru` из RIPE и автоматическую маршрутизацию запросов к таким адресам через внутренний сервер, чтобы не гонять пакеты через заграницу почём зря.

### Подготовка
Для удобства, на обоих серверах интерфейс Wireguard будет называться одинаково: `wg`.
Сами сервера в терминале удобней переименовать в нужные, чтоб не путаться в консоли:
```bash
hostnamectl set-hostname vpn-main
```

### Ставим Wireguard (на обе ноды):
```bash
apt update && apt install -y wireguard
```

### Включаем перенаправление трафика
Сервер, получив пакет, который не предназначается ни одному из его IP-адресов, не отбросит его, а попытается перенаправить в соответствии со своими маршрутами. Выполняем на обоих нодах:
```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv4.conf.all.forwarding=1" >> /etc/sysctl.conf
```
Проверяем: `sysctl -p /etc/sysctl.conf`

### Генерируем ключи
Приватный ключ генерируем командой `genkey`. Также при желании дополнительного шифрования, этой же утилитой можно генерировать и PresharedKey:
```bash
wg genkey
```

### Генерируем из приватного ключа публичный
```bash
echo "kOd3FVBggwpjD3AlZKXUxNTzJT0+f3MJdUdR8n6ZBn8=" | wg pubkey
```

### Создаём конфиги сервера и выходной ноды
Для удобства на обоих серверах интерфейсы называются просто `wg`. \
**Конфиг основного сервера:**
```
[Interface]
Address = 10.8.1.1/24
ListenPort = [PORT]
PrivateKey = SERVER_SECRET_KEY

PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostUp = ip rule add from `ip addr show eth0 | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'` table main
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
PostDown = ip rule del from `ip addr show eth0 | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'` table main

[Peer] # Out node
PublicKey = OUT_NODE_PUBLIC_KEY
PresharedKey = COMMON_PRESHARED_KEY
AllowedIPs = 10.8.1.2/32, 0.0.0.0/0

[Peer] # Client
PublicKey = CLIENT_PUBLIC_KEY
PresharedKey = COMMON_PRESHARED_KEY
AllowedIPs = 10.8.1.3

```
Разбор команд для iptables: \
```iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE```

Здесь происходит включение NAT в режиме маскарада: сервер будет отправлять пришедшие ему пакеты во внешнюю сеть, подменяя адрес отправителя своим, чтобы ответы на эти пакеты тоже приходили ему, а не исходному отправителю.

В конфиге основного сервера команда не использует подстановки, чтобы избежать проблем в настройке, так как интерфейс всё равно не должен меняться.

Вторая команда: \
```ip addr show eth0 | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'```
Команда получает данные интерфейса eth0 и вытаскивает из этих данных IP-адрес, в итоге превращаясь в следующую: \
```ip rule add from EXTERNAL_IP table main```

Это необходимо для основного сервера, потому что иначе при активации маршрута 0.0.0.0/0 он начинает пересылать ответы на пакеты, приходящие ему на внешние адреса через туннель WG. Наша out-node на том конце, конечно, пересылает их по назначению, но тут уже не готов отправитель пакета: он присылает что-то на внешний адрес нашего основного сервера, а ответ ему приходит с out-node.

**Конфиг выходного узла:**
```
[Interface]
Address = 10.8.1.2/24
ListenPort = [PORT]
PrivateKey = OUT_NODE_SECRET_KEY

PostUp = iptables -t nat -A POSTROUTING -o `ip route | awk '/default/ {print $5; exit}'` -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -o `ip route | awk '/default/ {print $5; exit}'` -j MASQUERADE

[Peer]
PublicKey = SERVER_PUBLIC_KEY
PresharedKey = COMMON_PRESHARED_KEY
AllowedIPs = 10.8.1.0/24
Endpoint = [SERVER_PUBLIC_IP]:[PORT]
PersistentKeepalive = 30
```
На выходном узле в правиле iptables для получения названия физического интерфейса, используется подстановка `ip route | awk '/default/ {print $5; exit}'`, она возвращает имя сетевого интерфейса, куда по умолчанию выполняется маршрутизация. Как правило это интерфейс, обращённый к провайдеру.

### Запускаем сервис на обеих нодах для проверки
```wg-quick up wg```

### Добавление сервиса в автозагрузку (после того как убедились, что туннель работает корректно):
```sudo systemctl enable wg-quick@wg```


======================================================================

### Повышаем безопасность
**Меняем порт SSH:** \
```sudo nano /etc/ssh/sshd_config```

Затем ребутим сервис SSH: \
```sudo systemctl restart ssh```

Добавляем новый порт и разрешаем поддержание открытых соединений (каждую строчку выполняем в консоли):
```bash
iptables -A INPUT -p tcp --dport 2222 -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables-save
```

Также рекомендуется добавить защиту от перебора пароля, например с помощью пакета fail2ban
```bash
sudo apt update
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```
Настройки Fail2ban хранятся в конфигурационном файле `/etc/fail2ban/jail.conf`.
Его следует скопировать в эту же директорию и переименовать в `jail.local`:

```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

=====================================================================

**Добавляем правила firewall**

На обоих серверах редактируем файл `/etc/default/ufw`,
изменяя значение `DEFAULT_FORWARD_POLICY` на `ACCEPT`.

Команды которые затем нужно выполнить для настройки файрвола (на обоих серверах):

```bash
ufw reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 51820/udp
ufw allow in on wg
systemctl enable ufw --now
ufw enable
```

### Дополнительная маршрутизация
Для получения всех адресов зоны .ru используем [скрипт](./get-ru-ips.sh), скачивающий адреса ру-зоны из RIPE.

Добавим данный скрипт в крон.
```bash
EDITOR=nano crontab -e
```
Следующие строчки запланируют запуск скрипта после перезагрузки и раз в неделю:
```
@reboot sleep 30 && bash /etc/wireguard/update_ru_routes.sh > /etc/wireguard/update_routes_log.txt 2>&1
0 3 * * mon bash /etc/wireguard/update_ru_routes.sh > /etc/wireguard/update_routes_log.txt 2>&1
```

Отдельные адреса, к которым клиенты также должны будут обращаться через внутренний сервер можно добавить в файл `subnets_user_list.txt` рядом с вышеописанным скриптом. Например:
```
#avito
146.158.48.0/21
#
#telegram
91.108.4.0/22
91.108.8.0/22
91.108.58.0/23
95.161.64.0/20
149.154.160.0/21
```

При необходимости вручную добавить отдельный маршрут, получаем адрес нужного сайта с клиента (выполняем на клиенте с отключенным VPN): `nslookup sbermarket.ru`

Далее узнаём дефолтный шлюз и устройство (это на основном сервере): `ip r`. Пример вывода:
```bash
ip r
default via 198.1.1.1 dev ens0 onlink
10.8.1.2 dev wg scope link
...
```
В данном примере `198.1.1.1` и `ens0` и есть дефолтный адрес шлюза и интерфейс. Добавить маршрут можно так:
```bash
target_ip="212.193.158.175/32"
gateway=`ip route | awk '/default/ {print $3; exit}'`
gateway_device=`ip route | awk '/default/ {print $5; exit}'`
ip route add $target_ip via $gateway dev $gateway_device
```
Проверять также через `ip r` (новый маршрут будет последним в списке). Как идут пакеты можно проверить командой `traceroute -r IP_ADDR`.
