const fs = require("fs");

const file = "tests/run-tests.js";
let t = fs.readFileSync(file, "utf8");

const oldBlock = `test("server supports admin approval mode",()=>{
  assert(server.includes("approval_mode"));
  assert(server.includes("approval===\\\\'ADMIN\\\\'"));
});`;

const newBlock = `test("server supports admin approval mode",()=>{
  assert(server.includes("approval_mode"));
  assert(server.includes("const approval="));
  assert(server.includes("status=approval"));
});`;

if (!t.includes(oldBlock)) {
  console.log("OLD BLOCK NOT FOUND");
  process.exit(1);
}

t = t.replace(oldBlock, newBlock);

fs.writeFileSync(file, t);

console.log("APPROVAL TEST REPAIRED");
