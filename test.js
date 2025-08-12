// Test file for AI Code Review
function unsafeFunction(userInput) {
    eval(userInput); // SECURITY ISSUE
    return "done";
}

function inefficientLoop(items) {
    let result = "";
    for (let i = 0; i < items.length; i++) {
        result += items[i]; // PERFORMANCE ISSUE
    }
    return result;
}

function buggyDivision(a, b) {
    return a / b;  // BUG: No zero check
}