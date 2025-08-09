// This script reads a JSON file containing polynomial roots,
// decodes the y-values, calculates the secret C, and finds
// the polynomial coefficients using Newton's divided differences.

// Import the 'fs' module for file system operations.
// This is a core Node.js module, so no installation is needed.
const fs = require('fs');

/**
 * Finds the secret C (the value of the polynomial at x=0)
 * using Lagrange Interpolation.
 * @param {Object.<string, number>} roots An object mapping x-values to decoded y-values.
 * @returns {number} The calculated secret C.
 */
const findSecretC = (roots) => {
    let secretC = 0.0;
    let numeratorProduct = 1.0;

    // Calculate the product of all (-x_i) for the numerator.
    for (const x of Object.keys(roots)) {
        numeratorProduct *= -parseInt(x, 10);
    }

    // Perform the Lagrange interpolation calculation.
    for (const x_j in roots) {
        const y_j = roots[x_j];
        let denominatorProduct = 1.0;

        for (const x_i in roots) {
            if (x_i !== x_j) {
                denominatorProduct *= (parseInt(x_j, 10) - parseInt(x_i, 10));
            }
        }
        
        const term = (numeratorProduct / (-parseInt(x_j, 10) * denominatorProduct)) * y_j;
        secretC += term;
    }

    // Return the rounded integer value of the secret C.
    return Math.round(secretC);
};

/**
 * Finds the polynomial coefficients from a set of roots using Newton's Divided Differences.
 * This method is more numerically stable for large inputs than direct matrix inversion.
 * @param {number[]} xValues An array of x-values.
 * @param {number[]} yValues An array of decoded y-values.
 * @returns {number[]} An array of polynomial coefficients, from the constant term to the highest degree.
 */
const findPolynomialCoefficients = (xValues, yValues) => {
    const n = xValues.length;
    const dividedDifferences = new Array(n).fill(0);
    
    // Initialize the first column of the divided differences table.
    for (let i = 0; i < n; i++) {
        dividedDifferences[i] = yValues[i];
    }

    // Compute the divided differences table.
    for (let j = 1; j < n; j++) {
        for (let i = n - 1; i >= j; i--) {
            dividedDifferences[i] = (dividedDifferences[i] - dividedDifferences[i-1]) / (xValues[i] - xValues[i-j]);
        }
    }
    
    // The coefficients for Newton's form are the diagonal elements of the table.
    const newtonCoefficients = [...dividedDifferences];

    // Convert from Newton's form to standard polynomial form (a_n*x^n + ... + a_0).
    const standardCoefficients = new Array(n).fill(0);
    standardCoefficients[0] = newtonCoefficients[0];

    for (let i = 1; i < n; i++) {
        for (let j = i; j >= 1; j--) {
            standardCoefficients[j] = standardCoefficients[j-1] - standardCoefficients[j] * xValues[i-1];
        }
        standardCoefficients[0] = newtonCoefficients[i] - standardCoefficients[0] * xValues[i-1];
    }
    
    // The coefficients are in reverse order (a_n, a_{n-1}, ..., a_0).
    // We reverse them to get a_0, a_1, ..., a_n.
    return standardCoefficients.map(c => Math.round(c)).reverse();
};


// --- Main Execution Logic ---

// Check for the command-line argument.
if (process.argv.length < 3) {
    console.error('Usage: node script.js <path_to_json_file>');
    process.exit(1); // Exit with an error code.
}

const jsonFilePath = process.argv[2];

try {
    // Read the file content synchronously.
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Get the required number of roots (k).
    const k = data.keys.k;
    if (!k) {
        console.error("Error: JSON file is missing the 'keys.k' property.");
        process.exit(1);
    }
    
    const roots = {};
    const xValues = [];
    const yValues = [];

    // Parse the JSON data to extract and decode the roots.
    for (const key in data) {
        // Skip the 'keys' object.
        if (key === 'keys') continue;

        const x = parseInt(key, 10);
        const { value, base } = data[key];

        if (x && value && base) {
            // Decode the y-value from its given base.
            const decodedY = parseInt(value, base);
            if (isNaN(decodedY)) {
                console.error(`Error: Failed to decode value for key "${key}".`);
                process.exit(1);
            }
            
            roots[x] = decodedY;
            xValues.push(x);
            yValues.push(decodedY);
        }
    }
    
    // Ensure we have at least k roots to solve for the polynomial.
    if (Object.keys(roots).length < k) {
        console.error(`Error: Insufficient roots. Expected at least ${k}, but found ${Object.keys(roots).length}.`);
        process.exit(1);
    }
    
    // Sort the x-values and y-values to ensure correct order for interpolation.
    xValues.sort((a, b) => a - b);
    const sortedYValues = xValues.map(x => roots[x]);
    
    // Calculate the secret C.
    const secretC = findSecretC(roots);

    // Find the polynomial coefficients.
    const coefficients = findPolynomialCoefficients(xValues.slice(0, k), sortedYValues.slice(0, k));

    // Display the results.
    console.log('--- Calculation Results ---');
    console.log(`Secret C: ${secretC}`);
    console.log('Polynomial Coefficients:');
    console.log(coefficients);
    
} catch (error) {
    console.error('An error occurred while processing the file:');
    console.error(error.message);
    process.exit(1);
}
