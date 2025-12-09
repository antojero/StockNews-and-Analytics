import axios from 'axios';

const useAxios = () => {
    const authTokens = localStorage.getItem('authTokens')
        ? JSON.parse(localStorage.getItem('authTokens'))
        : (sessionStorage.getItem('authTokens') ? JSON.parse(sessionStorage.getItem('authTokens')) : null);

    const axiosInstance = axios.create({
        baseURL: 'http://localhost:8000',
        headers: { Authorization: `Bearer ${authTokens?.access}` }
    });

    return axiosInstance;
};

export default useAxios;
