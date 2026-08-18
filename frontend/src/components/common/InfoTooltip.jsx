import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

const DEFINITIONS = {
  'SHAP': "A method that fairly credits each factor (amount, device, etc.) for how much it added to the risk score — the numbers always add up exactly to the total.",
  'Shapley Attribution': "A method that fairly credits each factor (amount, device, etc.) for how much it added to the risk score — the numbers always add up exactly to the total.",
  'SHAP / Shapley Attribution': "A method that fairly credits each factor (amount, device, etc.) for how much it added to the risk score — the numbers always add up exactly to the total.",
  'Risk Band': "A simple category (Low/Medium/High/Critical) based on the score, so anyone can tell severity at a glance.",
  'ML Fraud Probability': "A second opinion from a statistical model, shown alongside — not instead of — our rule-based score.",
  'RAG Grounded': "The AI's answers are based on real policy documents we retrieve, not made up from general knowledge.",
  'RAG Grounding': "The AI's answers are based on real policy documents we retrieve, not made up from general knowledge.",
  'Event Bus / Kafka-Ready': "Behind the scenes, each part of the system (scoring, alerts, dashboard) talks through a shared message system, so they don't depend directly on each other.",
  'Event Bus': "Behind the scenes, each part of the system (scoring, alerts, dashboard) talks through a shared message system, so they don't depend directly on each other.",
  'Rule Score': "Our main, fully-explainable score — six simple checks, each worth points, added up out of 100.",
  'Deterministic Rule Score': "Our main, fully-explainable score — six simple checks, each worth points, added up out of 100."
};

export function InfoTooltip({ 
  term, 
  explanation, 
  children, 
  showIcon = true,
  position = 'top',
  className = '' 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const textExplanation = explanation || DEFINITIONS[term] || (term && DEFINITIONS[Object.keys(DEFINITIONS).find(k => term.toLowerCase().includes(k.toLowerCase()))]) || '';
  const tooltipRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    }
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <span 
      ref={tooltipRef}
      className={`relative inline-flex items-center gap-1 group/tooltip align-middle ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsVisible(prev => !prev);
      }}
    >
      {children ? (
        <span className="inline-flex items-center gap-1 border-b border-dotted border-slate-500/80 hover:border-cyan-400 cursor-help transition-colors">
          {children}
        </span>
      ) : null}

      {showIcon && (
        <button
          type="button"
          aria-label={`Explanation for ${term || 'term'}`}
          className="text-slate-400 hover:text-cyan-300 focus:outline-none p-0.5 rounded transition-colors inline-flex items-center justify-center cursor-help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {isVisible && textExplanation && (
        <span 
          role="tooltip"
          className={`absolute z-50 w-64 max-w-xs p-2.5 bg-slate-900/95 border border-slate-700 text-slate-200 text-[11px] font-sans font-normal leading-relaxed rounded-xl shadow-2xl backdrop-blur-md pointer-events-none transition-opacity duration-150 animate-fadeIn ${positionClasses[position] || positionClasses.top}`}
        >
          {term && (
            <span className="block font-bold text-cyan-300 font-mono text-[10px] uppercase tracking-wider mb-1 border-b border-slate-800 pb-0.5">
              {term}
            </span>
          )}
          <span className="block text-slate-300 font-sans">
            {textExplanation}
          </span>
        </span>
      )}
    </span>
  );
}
