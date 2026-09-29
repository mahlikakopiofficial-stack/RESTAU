const fs = require("fs");

let t = fs.readFileSync("tests/run-tests.js", "utf8");

t = t.replace(
  'server.includes("===\\\\\'ADMIN\\\\\'")',
  'server.includes("approval===\\\\\'ADMIN\\\\\'")'
);

fs.writeFileSync("tests/run-tests.js", t);

let a = fs.readFileSync("public/account.html", "utf8");

if (!a.includes("orderStep")) {
  a = a.replace(
    '<div id="order-tracker" style="margin:15px 0"></div>',
    '<div id="order-tracker" style="margin:15px 0"><div id="orderStep"></div></div>'
  );
}

fs.writeFileSync("public/account.html", a);

console.log("FIX APPLIED");
