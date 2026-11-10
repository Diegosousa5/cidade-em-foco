
const LOCAL_API_URL = "http://localhost:8080";
const PRODUCTION_API_URL = "https://cidade-em-foco.onrender.com";

const isLocal = ["localhost", "127.0.0.1"].includes(
    window.location.hostname
);

export const API_BASE_URL = (
    isLocal ? LOCAL_API_URL : PRODUCTION_API_URL
).replace(/\/+$/, "");
