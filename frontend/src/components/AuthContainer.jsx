import React, { useState } from 'react';

const AuthContainer = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        main_goal: '',
        learning_preference: ''
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleForm = () => {
        setIsLogin(!isLogin);
        setError('');
        setMessage('');
        setFormData({
            name: '',
            email: '',
            password: '',
            main_goal: '',
            learning_preference: ''
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            if (isLogin) {
                const urlEncodedData = new URLSearchParams();
                urlEncodedData.append('username', formData.email);
                urlEncodedData.append('password', formData.password);

                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: urlEncodedData
                });
                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.access_token);
                    if (onLoginSuccess) {
                        onLoginSuccess(data.access_token);
                    }
                } else {
                    setError(data.detail || 'Login failed. Please check your credentials.');
                }
            } else {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        password: formData.password,
                        main_goal: formData.main_goal,
                        learning_preference: formData.learning_preference
                    })
                });
                const data = await response.json();

                if (response.ok) {
                    setMessage(data.message + " Please sign in.");
                    setIsLogin(true); // Switch to login view
                    setFormData(prev => ({ ...prev, password: '' })); // clear password
                } else {
                    setError(data.detail || 'Registration failed.');
                }
            }
        } catch (err) {
            setError('An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h2 className="auth-title">{isLogin ? 'Sign In' : 'Create Account'}</h2>

            {message && <div className="status-indicator success">{message}</div>}
            {error && <div className="status-indicator error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
                {!isLogin && (
                    <div className="input-group">
                        <label htmlFor="name">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                )}

                <div className="input-group">
                    <label htmlFor="email">Email Address</label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                </div>

                <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required minLength={isLogin ? "1" : "6"} />
                </div>

                {!isLogin && (
                    <>
                        <div className="input-group">
                            <label htmlFor="main_goal">Main Goal</label>
                            <input type="text" id="main_goal" name="main_goal" value={formData.main_goal} onChange={handleChange} placeholder="e.g., Get an AI/ML Internship" />
                        </div>
                        <div className="input-group">
                            <label htmlFor="learning_preference" className="optional-label" title="How do you learn best?">
                                Learning Preference <span className="optional-tag">(Optional)</span>
                            </label>
                            <select id="learning_preference" name="learning_preference" value={formData.learning_preference} onChange={handleChange} className="custom-select">
                                <option value="">Select a preference...</option>
                                <option value="Visual learner">Visual learner</option>
                                <option value="Uses analogies">Uses analogies</option>
                                <option value="Theory first">Theory first</option>
                                <option value="Hands-on practice">Hands-on practice</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </>
                )}

                <button type="submit" className="primary-action-btn" disabled={loading}>
                    {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
            </form>

            <div className="auth-footer">
                <p className="toggle-text" onClick={toggleForm}>
                    {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </p>

                <div className="secondary-auth">
                    <div className="divider">
                        <span>Or sign in with</span>
                    </div>
                    <div className="social-login-placeholders">
                        <button type="button" className="social-btn google-btn">G</button>
                        <button type="button" className="social-btn github-btn">GH</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthContainer;
