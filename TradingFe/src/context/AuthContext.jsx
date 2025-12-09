import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [authTokens, setAuthTokens] = useState(() => {
        // Check local storage first (Remember Me)
        let token = localStorage.getItem('authTokens');
        if (token) return JSON.parse(token);

        // Then check session storage (Active Session)
        token = sessionStorage.getItem('authTokens');
        if (token) return JSON.parse(token);

        return null;
    });

    const [loading, setLoading] = useState(true);

    // Initial load user from token and handle loading state
    useEffect(() => {
        if (authTokens) {
            setUser(jwtDecode(authTokens.access));
        }
        setLoading(false);
    }, [authTokens]);

    const loginUser = async (username, password, rememberMe = false) => {
        try {
            const response = await axios.post('http://localhost:8000/api/token/', {
                username,
                password
            });

            if (response.status === 200) {
                setAuthTokens(response.data);
                setUser(jwtDecode(response.data.access));

                if (rememberMe) {
                    localStorage.setItem('authTokens', JSON.stringify(response.data));
                } else {
                    sessionStorage.setItem('authTokens', JSON.stringify(response.data));
                }
                return true;
            }
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
        return false;
    };

    const registerUser = async (username, email, password, confirmPassword) => {
        try {
            await axios.post('http://localhost:8000/api/register/', {
                username,
                email,
                password,
                confirm_password: confirmPassword
            });
            return true;
        } catch (error) {
            console.error("Registration failed:", error);
            throw error;
        }
    };

    const logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        sessionStorage.removeItem('authTokens');
    };

    const contextData = {
        user,
        authTokens,
        loginUser,
        logoutUser,
        registerUser,
        loading
    };

    return (
        <AuthContext.Provider value={contextData}>
            {loading ? null : children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
