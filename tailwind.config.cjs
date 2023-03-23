/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["index.html", "./controllers/**/*.ts"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/forms")],
};
