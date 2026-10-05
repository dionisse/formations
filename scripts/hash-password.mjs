import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "MotDePasseFort"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (error, derived) => {
  if (error) throw error;
  console.log(`pbkdf2$100000$64$${salt.toString('hex')}$${derived.toString('hex')}`);
});
