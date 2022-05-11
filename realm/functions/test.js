exports = function addition(first, second) {
  if (typeof first !== typeof second && typeof first !== "number") {
    throw new Error("This function takes 2 numbers");
  }
  return first + second;
};
