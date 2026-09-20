/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["clsx", "cva"],
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: "all",
  arrowParens: "always",
};

export default config;
