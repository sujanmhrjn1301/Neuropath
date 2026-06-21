import React, { useState } from 'react';

const MCQCard = ({ questions, onSelect, onSkip }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});

    const handleNext = () => {
        if (currentIndex < questions?.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleOptionClick = (answer) => {
        const newAnswers = { ...answers, [currentIndex]: answer };
        setAnswers(newAnswers);
        
        if (currentIndex < (questions?.length || 0) - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            submitAllAnswers(newAnswers);
        }
    };

    const submitAllAnswers = (finalAnswers) => {
        if (!questions) return;
        const summary = questions.map((q, idx) => {
            return `Question: ${q.question}\nResponse: ${finalAnswers[idx] || "Skipped"}`;
        }).join("\n\n");
        onSelect("Multiple Questions", summary);
    };

    if (!questions || questions.length === 0) return null;
    const currentQuestion = questions[currentIndex];
    const totalQuestions = questions.length;

    return (
        <div className="mcq-card-wrapper animate-slide-up">
            <div className="mcq-card">
                <div className="mcq-body">
                    <div className="mcq-header-row">
                        <h2 className="mcq-question-text">{currentQuestion.question}</h2>
                        <div className="mcq-nav-compact">
                            <button className="mcq-nav-btn" onClick={handlePrev} disabled={currentIndex === 0}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span className="mcq-progress-text">{currentIndex + 1} of {totalQuestions}</span>
                            <button className="mcq-nav-btn" onClick={handleNext} disabled={currentIndex === totalQuestions - 1}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                            <button className="mcq-close-btn" onClick={onSkip}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div className="mcq-options-grid">
                        {currentQuestion.options.map((option, idx) => {
                            const isSelected = answers[currentIndex] === option;
                            return (
                                <button 
                                    key={idx} 
                                    className={`mcq-option-mini ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleOptionClick(option)}
                                >
                                    <div className="mcq-option-num-mini">{idx + 1}</div>
                                    <div className="mcq-option-label-mini">{option}</div>
                                    <svg className="mcq-mini-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                </button>
                            );
                        })}

                        <div className="mcq-input-row">
                            <div className="mcq-manual-wrapper-mini">
                                <input 
                                    type="text" 
                                    placeholder="Something else..." 
                                    className="mcq-input-mini"
                                    value={answers[currentIndex] && !currentQuestion.options.includes(answers[currentIndex]) ? answers[currentIndex] : ""}
                                    onChange={(e) => setAnswers({...answers, [currentIndex]: e.target.value})}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleOptionClick(e.target.value);
                                        }
                                    }}
                                />
                                {currentIndex === totalQuestions - 1 ? (
                                    <button 
                                        className="mcq-submit-mini"
                                        style={{ background: '#5A72F6', color: '#fff', borderColor: '#5A72F6' }}
                                        onClick={() => submitAllAnswers(answers)}
                                    >
                                        Finish
                                    </button>
                                ) : (
                                    <button 
                                        className="mcq-submit-mini"
                                        onClick={() => handleOptionClick("Skipped")}
                                    >
                                        Skip
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MCQCard;
