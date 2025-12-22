import { auth } from '../firebase.js';
import { API_BASE_URL as API_URL } from './config.js';

/**
 * Generic API Call wrapper with Auth Token
 * @param {string} endpoint - e.g. '/uptime/create'
 * @param {string} method - 'GET', 'POST', 'PUT', 'DELETE'
 * @param {object} body - JSON body
 */
export async function callApi(endpoint, method, body) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const token = await user.getIdToken();

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    // Only include body for non-GET requests
    if (method !== 'GET' && body) {
        options.body = JSON.stringify(body);
    }

    // Add cache-busting for GET requests
    const urlWithCache = method === 'GET'
        ? `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`
        : `${API_URL}${endpoint}`;

    let response;
    try {
        response = await fetch(urlWithCache, options);
    } catch (networkError) {
        console.error("Network Error:", networkError);
        throw new Error("No hay conexión con el servidor. Verifica tu internet.");
    }

    if (!response.ok) {
        let errorMsg = "Error en API";
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (jsonError) {
            errorMsg = response.statusText || ("Error " + response.status);
        }
        throw new Error(errorMsg);
    }

    return await response.json();
}
