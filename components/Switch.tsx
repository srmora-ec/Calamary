import React, { useState, useEffect } from "react";

interface SwitchProps {
    option1: { label: string; value: string };
    option2: { label: string; value: string };
    defaultValue?: string;
    onChange?: (active: string) => void;
}

const Switch: React.FC<SwitchProps> = ({ option1, option2, defaultValue, onChange }) => {
    const [active, setActive] = useState(defaultValue || option1.value);

    useEffect(() => {
        // si hay defaultValue cambia el estado inicial
        if (defaultValue) setActive(defaultValue);
    }, [defaultValue]);

    const handleClick = () => {
        const next = active === option1.value ? option2.value : option1.value;
        setActive(next);
        if (onChange) onChange(next);
    };

    return (
        <div
            className="relative w-48 h-12 bg-gray-200 rounded-full cursor-pointer select-none flex items-center p-1"
            onClick={handleClick}
        >
            {/* Slider */}
            <div
                className={`absolute top-1 left-1 h-10 w-1/2 bg-blue-500 rounded-full shadow-md transform transition-transform duration-300 ${active === option2.value ? "translate-x-full" : ""
                    }`}
            />
            {/* Textos */}
            <div className="relative z-10 flex w-full">
                <span
                    className={`text-xs w-1/2 flex justify-center items-center font-semibold transition-colors duration-300 ${active === option1.value ? "text-white" : "text-gray-500"
                        }`}
                >
                    {option1.label}
                </span>
                <span
                    className={`text-xs w-1/2 flex justify-center items-center font-semibold transition-colors duration-300 ${active === option2.value ? "text-white" : "text-gray-500"
                        }`}
                >
                    {option2.label}
                </span>
            </div>


        </div>
    );
};

export default Switch;
