/**
 * Utility function to generate a general code
 * @param {number} id - The ID to format
 * @param {string} prefix - The prefix for the code
 * @param {number} digits - The minimum number of digits for the ID part (default is 6)
 * @param {boolean} useGrouping - Whether to use grouping in the number (default is false)
 * @returns {string} - The formatted code
 */
function generateCode(
  id: number,
  prefix: string,
  digits: number = 6,
  useGrouping: boolean = false,
): string {
  return `${prefix}-${id.toLocaleString("en-US", {
    minimumIntegerDigits: digits,
    useGrouping: useGrouping,
  })}`;
}

export default generateCode;
