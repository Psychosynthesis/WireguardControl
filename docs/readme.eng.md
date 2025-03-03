## Wireguard Control — Web Interface for WireGuard
A simple web interface for WireGuard VPN that allows using existing configurations or setting up new ones.

### Features and Characteristics
- Adding clients via the web interface
- Tracking status in the interface
- Reloading WireGuard via the web interface
- Working with multiple `.conf` files (interfaces)
- Written in JS, with a maximally simple and open interface, allowing on-the-fly edits without the need for building
- Does not use any databases (data is stored in JSON)

### Disadvantages
- Applying a configuration (*e.g., after adding a client*) requires a WireGuard reload
- Client data (pubkey, presharedkey, etc.) is stored without any encryption
- Requires NodeJS to be installed, and preferably PM2 for automatic restart support

### Preparation
WireGuard and NodeJS are required. The guide below is for Ubuntu.
```bash
sudo apt install wireguard
```
The easiest way to install the required version of NodeJS is via [NVM](https://github.com/nvm-sh/nvm). This project was tested on NodeJS v.20.10, but it will likely work on older versions as well (probably even on version 12), so you can try installing NodeJS via `apt`. Below are example commands for installing NVM:
```bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

source ~/.bashrc
```
You can check if `nvm` is installed by running `nvm -v`. After that, install the recommended NodeJS version:
```bash
nvm install 20.10.0
```

### Installation
Clone the repository into a convenient folder (here, for example, it's `/var/wg-control`):
```bash
git clone https://github.com/Psychosynthesis/WireguardControl.git /var/wg-control
```

Navigate to the created folder and install the dependencies:
```bash
cd /var/wg-control

npm i
```

### Launch
Navigate to the previously created folder and start the server:
```bash
cd /var/wg-control

npm run start
```
Don't forget to specify your settings in the file `config.example.json` (on first launch it will be renamed to `config.json` file). You should set the default WG-interface and add your server's IP (in VPN network) to `allowedOrigins`. Also ensure that the `webServerPort` used by this server by default (`8877`) is open in the firewall (if you have port blocking enabled).

**BE SURE TO CHANGE THE DEFAULT ENCRYPTION KEY!**

Note that you can generate a random key for yourself directly in bash, for example in the following ways:
```bash
# Using openssl:
openssl rand -base64 16
# Using /dev/urandom and base64:
head -c 16 /dev/urandom | base64
```
Or run it in the developer console in the browser, opening the Wireguard Control web interface:
```javascript
// The forge library is used in public\index.html for encryption
forge.util.encode64(forge.random.getBytes(16));
```

After this, the interface will be accessible in your browser at your server's address, for example, `http://10.8.2.1:9876/`.
If you did this before manually creating the first client for WireGuard, you need to add your public IP and the `webServerPort` not blocked by your firewall to `allowedOrigins`.

Next, add the server script to autostart. There are several ways to do this, but the most convenient and simple is to use the `pm2` tool, which, among other things, allows for load distribution and memory usage monitoring.

```bash
npm install pm2 -g
cd /var/wg-control && pm2 start ecosystem.json --watch --ignore-watch="node_modules"
pm2 startup
pm2 save
```
Now, to monitor the server's status, simply run `pm2 monit`.

### Additional Information
Additional client data is stored in the `.data` folder in the `peers.json` file in the following format:
```JSON
{
  "PEER1_PUBLIC_KEY":{"name":"PEER1_NAME"},
  "PEER2_PUBLIC_KEY":{"name":"PEER2_NAME"}
}
```

When loading, `Wireguard-Control` searches for all available configs in `/etc/wireguard`, parses them, and loads them into memory, so the system does not access configuration files when requesting status.

### Additional Resources

[Example WireGuard configuration for a corporate network](./sample.conf.md)
