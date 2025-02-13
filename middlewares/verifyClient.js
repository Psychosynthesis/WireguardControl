// В продакшене следует менять код постоянно!
const VERIFICATION_CODE = 'HGJGRGSADF12342kjSJF3riuhfkds3';

// Данный посредник проверяет, валиден ли клиент отправивший данные
export const verifyClient = async (req, res, next) => {
  const verificationCode = req.headers['x-verification-code'];

  if (!verificationCode || verificationCode !== VERIFICATION_CODE) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}
