require('dotenv').config();
const { NODE_ENV, BASE_URL, EXPO_SCHEME } = process.env;

const KEYS = {
    NODE_ENV,
    BASE_URL,
    EXPO_SCHEME
}


const REQUIRED_KEYS = Object.keys(KEYS).filter(key => !KEYS[key]);

if (REQUIRED_KEYS.length > 0) {
    console.warn("[ENV] Missing required environment variables ⭕:", REQUIRED_KEYS.join(", "));
    process.exit(1);
}

console.warn("[ENV] All required environment variables are set ✅.");