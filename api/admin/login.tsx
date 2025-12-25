// src/pages/Login.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // If using routing

const Login = () => {
    const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [data, setData] = useState<any>(null);
    const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();

    const startDeviceFlow = async () => {
        setStatus('pending');
        try {
            const res = await fetch('/api/auth/github/device');
            const json = await res.json();
            setData(json);
            alert(`Go to ${json.verification_uri} and enter code: ${json.user_code}`);

            // Start polling
            const intervalId = setInterval(async () => {
                const pollRes = await fetch(`/api/auth/github/device/poll/${json.device_code}`);
                const pollData = await pollRes.json();

                if (pollData.access_token) {
                    clearInterval(intervalId);
                    setStatus('success');
                    // Store token (localStorage for simplicity, or secure cookie/session)
                    localStorage.setItem('github_token', pollData.access_token);
                    navigate('/admin'); // Redirect to admin
                } else if (pollData.error) {
                    clearInterval(intervalId);
                    setStatus('error');
                }
            }, 5000); // Poll every 5s (adjust to interval from response)

            setPollInterval(intervalId);
        } catch (err) {
            setStatus('error');
            console.error(err);
        }
    };

    useEffect(() => {
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [pollInterval]);

    return (
        <div className="p-8 bg-black text-cyan-300 min-h-screen flex flex-col items-center justify-center">
            <h1 className="text-4xl mb-6">Shadow Fox Den</h1>
            <p className="text-lg mb-8">Only the worthy enter the shadows...</p>

            {status === 'idle' && (
                <button
                    onClick={startDeviceFlow}
                    className="bg-purple-600 px-8 py-4 rounded-lg text-xl hover:bg-purple-700"
                >
                    Summon GitHub Device Flow
                </button>
            )}

            {status === 'pending' && data && (
                <div className="text-center">
                    <p className="text-2xl mb-4">Go to: <a href={data.verification_uri} target="_blank" className="text-cyan-400 underline">{data.verification_uri}</a></p>
                    <p className="text-3xl font-bold mb-2">Code: {data.user_code}</p>
                    <p className="text-sm">Polling... (expires in {data.expires_in} seconds)</p>
                </div>
            )}

            {status === 'success' && <p className="text-green-400 text-2xl">Access granted! Redirecting...</p>}
            {status === 'error' && <p className="text-red-400 text-2xl">Error summoning the flow. Try again.</p>}
        </div>
    );
};

export default Login;