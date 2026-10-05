import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "MotDePasseFort"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derived) => {
  if (error) throw error;
  console.log(`scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`);
});
