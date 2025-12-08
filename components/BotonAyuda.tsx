import React from 'react';
import { Popover, Button } from 'antd';
import { HelpCircle, ExternalLink } from 'lucide-react';

interface BotonAyudaProps {
    children: React.ReactNode;
    route: string;
    labelButton?: string;
}

export default function BotonAyuda({
    children,
    route,
    labelButton = "Ver guía completa"
}: BotonAyudaProps) {

    // Contenido que irá DENTRO de la burbuja (Popover)
    const contenidoPopover = (
        <div className="max-w-[250px] space-y-3">
            <div className="text-slate-600 text-sm leading-relaxed">
                {children}
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <a
                href={route}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
            >
                <Button
                    type="primary"
                    size="small"
                    ghost
                    className="w-full flex items-center justify-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                    {labelButton}
                    <ExternalLink size={14} />
                </Button>
            </a>
        </div>
    );

    return (
        <Popover
            content={contenidoPopover}
            trigger="click"
            placement="bottomRight"
        >
            <button
                type="button"
                className="
    w-8 h-8
    rounded-full 
    bg-emerald-500 hover:bg-emerald-600 
    text-white 
    flex items-center justify-center 
    transition-all duration-200 
    shadow-sm hover:shadow-md 
    active:scale-95
    cursor-pointer
  "
            >

                <HelpCircle size={18} strokeWidth={2.5} />
            </button>
        </Popover>
    );
}