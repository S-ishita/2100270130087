const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 9876;

const WINDOW_SIZE = 10;
const MAX_RESPONSE_TIME = 500; // ms
const TEST_SERVER_BASE_URL = 'http://20.244.56.144/test';
const AUTH_SERVER_URL = 'http://20.244.56.144/test/auth';

const CLIENT_ID = 'sample id'; //add id
const CLIENT_SECRET = 'sample secret'; // add secret

let AUTH_TOKEN = '';
let numberWindow = [];

// Helper function to get the API endpoint based on the number ID
function getApiEndpoint(id) {
    const endpoints = {
        p: '/primes',
        f: '/fibo',
        e: '/even',
        r: '/random',
    };
    return endpoints[id] || null;
}

// Helper function to fetch the authorization token
async function fetchAuthToken() {
    try {
        const response = await axios.post(AUTH_SERVER_URL, {
            companyName: 'goMart',
            clientID: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            ownerName: 'Rahul',
            ownerEmail: 'rahul@abc.edu',
            rollNo: '1'
        });

        AUTH_TOKEN = response.data.token_type + ' ' + response.data.access_token;
    } catch (error) {
        console.error('Error fetching auth token:', error);
        throw error;
    }
}

// Helper function to fetch numbers from the third-party server
async function fetchNumbers(id) {
    const endpoint = getApiEndpoint(id);
    if (!endpoint) {
        throw new Error('Invalid number ID');
    }

    try {
        const response = await axios.get(`${TEST_SERVER_BASE_URL}${endpoint}`, {
            timeout: MAX_RESPONSE_TIME,
            headers: {
                'Authorization': AUTH_TOKEN,
                'x-client-id': CLIENT_ID,
                'x-client-secret': CLIENT_SECRET
            }
        });
        return response.data.numbers;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // Authorization error, fetch a new token
            await fetchAuthToken();

            // Retry the request with the new token
            const response = await axios.get(`${TEST_SERVER_BASE_URL}${endpoint}`, {
                timeout: MAX_RESPONSE_TIME,
                headers: {
                    'Authorization': AUTH_TOKEN,
                    'x-client-id': CLIENT_ID,
                    'x-client-secret': CLIENT_SECRET
                }
            });
            return response.data.numbers;
        } else {
            // Handle other errors
            // ...
        }
    }
}

// Helper function to update the number window
function updateWindow(newNumbers) {
    const uniqueNewNumbers = newNumbers.filter(num => !numberWindow.includes(num));
    numberWindow = [...numberWindow, ...uniqueNewNumbers].slice(-WINDOW_SIZE);
}

// Helper function to calculate average
function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

// GET / - Root route to provide API information
app.get('/', (req, res) => {
    res.json({
        message: 'Average Calculator HTTP Microservice',
        usage: 'GET /numbers/:numberid',
        validNumberIds: ['p (primes)', 'f (Fibonacci)', 'e (even)', 'r (random)'],
    });
});

// GET /numbers/:numberid - Calculate average from qualified number IDs
app.get('/numbers/:numberid', async (req, res) => {
    const { numberid } = req.params;

    if (!getApiEndpoint(numberid)) {
        return res.status(400).json({ error: 'Invalid number ID' });
    }

    const startTime = Date.now();
    const windowPrevState = [...numberWindow];

    try {
        const newNumbers = await fetchNumbers(numberid);
        updateWindow(newNumbers);

        const responseTime = Date.now() - startTime;
        if (responseTime > MAX_RESPONSE_TIME) {
            console.warn(`Response time exceeded ${MAX_RESPONSE_TIME}ms: ${responseTime}ms`);
            return res.status(500).json({ error: 'Response time exceeded limit' });
        }

        const response = {
            windowPrevState,
            windowCurrState: numberWindow,
            numbers: newNumbers,
            avg: calculateAverage(numberWindow),
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch the initial authorization token
fetchAuthToken();

// Start the server
app.listen(port, () => {
    console.log(`Average Calculator service running on http://localhost:${port}`);
});
