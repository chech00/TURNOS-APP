const { getDependentNodes } = require("./src/utils/dependencies");

const parent = "NODO ALERCE 3";
console.log(`🔍 Checking dependencies for parent: "${parent}"`);

const dependents = getDependentNodes(parent, true);
console.log(`Children found (${dependents.length}):`, dependents);

if (dependents.length === 0) {
    console.error("❌ ERROR: No dependencies found! Topology might be broken.");
} else {
    console.log("✅ Topology looks good.");
}
