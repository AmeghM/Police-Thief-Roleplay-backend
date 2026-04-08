export const generateCode = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  let code = "";

  for (let i = 0; i < 2; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let j = 0; j < 3; j++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }

  return code;
};
