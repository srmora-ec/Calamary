"use client"

import React, { useState, useEffect } from 'react';
import { Drawer } from 'antd';
import { Menu, BookOpen, AlertCircle, ChevronRight, Hash } from 'lucide-react';
import Header from '@/components/Header';
import { useTranslation } from 'react-i18next';


export default function GuiaMejorada() {
  const [openDrawer, setOpenDrawer] = useState(false);
const {t} = useTranslation()
  // Lógica extra: Si agrandas la pantalla (rotas la tablet o pasas a monitor), cerramos el drawer móvil.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // 1024px es el breakpoint 'lg' de Tailwind
        setOpenDrawer(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Componente del Índice (Reutilizable para Sidebar y Drawer)
  const IndiceLinks = () => (
    <nav className="text-sm">
      <ul className="space-y-3 border-l border-slate-200 ml-2">
        <li>
          <a
            href="#crear-discretos"
            onClick={() => setOpenDrawer(false)}
            className="block pl-4 text-slate-600 hover:text-blue-600 hover:border-l-2 hover:border-blue-600 -ml-[1px] transition-all py-1"
          >
            {t('docs.discretos.crearv')} (MAUT)
          </a>
        </li>
        <>Luego ira lo otro</>
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-blue-100">
      <Header />
      {/* --- HEADER MÓVIL (Solo visible < 1024px) --- */}
      <div className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setOpenDrawer(true)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* --- DRAWER (Menú Lateral Móvil) --- */}
      <Drawer
        title="Contenido"
        placement="right"
        onClose={() => setOpenDrawer(false)}
        open={openDrawer}
        width={300} // Un ancho cómodo para móvil
      >
        <IndiceLinks />
      </Drawer>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          <main className="lg:col-span-9">

            <div className="mb-10 border-b border-slate-100 pb-8">
              <br />
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
                Valores discretos
              </h1>
              <p className="text-lg md:text-xl text-slate-500 leading-relaxed">
                Los valores discretos (cualitativos) son aquellos datos que describen categorías, características o cualidades que no pueden medirse numéricamente de manera continua. No representan cantidades, sino tipos o grupos. Cada dato pertenece a una categoría específica y no existen valores intermedios entre una categoría y otra.
              </p>
            </div>
            <br />
            <div className="space-y-20"> {/* Espacio vertical generoso entre secciones */}
              <section id="crear-discretos" className="scroll-mt-28">
                <h2 className="text-2xl font-bold text-slate-900 mb-5 flex items-center group">
                  <span className="text-blue-500 opacity-0 group-hover:opacity-100 mr-2 transition-opacity -ml-6 w-6">#</span>
                  Crear valores discretos para un criterio (MAUT)
                </h2>
                <br />
                {/* Alerta Visual */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-lg mb-8">
                  <div className="flex gap-3">
                    <AlertCircle className="text-amber-600 w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm uppercase">Método Maut</h4>
                      <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                        Para poder realizar este proceso el criterio debe ser de un modelo con el método <strong>MAUT</strong>.
                      </p>
                    </div>
                  </div>
                </div>
                <br />
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                      <div className="w-0.5 h-full bg-slate-100 mt-2"></div>
                    </div>
                    <div className="pb-8">
                      <h4 className="font-semibold text-slate-900">Crear criterio</h4>
                      <p className="text-slate-600 text-sm mt-1">Clic derecho sobre el criterio raiz {'>'} Clic en crear hijo </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
                      <div className="w-0.5 h-full bg-slate-100 mt-2"></div>
                    </div>
                    <div className="pb-8">
                      <h4 className="font-semibold text-slate-900">Abrir modulo para configurar valores discretos</h4>
                      <p className="text-slate-600 text-sm mt-1">Clic derecho sobre el criterio al cuál se le quieren asignar valores discretos  {'>'} Clic en "Configuración de utlidad"   {'>'}  Clic en el tab de Valores discretos (Categórica).</p>
                      <div style={{ padding: 50 }}>
                        <img src="/assetsdoc/creardis.gif" alt="Animación" />
                      </div>
                    </div>
                    <br />

                  </div>

                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">3</div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Asignar valores discretos</h4>
                      <p className="text-slate-600 text-sm mt-1">Registras los valores discretos que necesitas para evaluar tu criterio y precionas agregar.</p>
                    </div>


                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">4</div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Guardar los cambios</h4>
                      <p className="text-slate-600 text-sm mt-1">Finalmente presionas "Guardar cambios".</p>
                      <div style={{ padding: 50 }}>
                        <img src="/assetsdoc/creardoscre.gif" alt="Animación" />
                      </div>
                    </div>


                  </div>
                </div>
              </section>

            </div>
          </main>

          {/* SIDEBAR DERECHO (Solo Desktop > 1024px) */}
          <aside className="hidden md:block lg:col-span-3">
            <div className="sticky top-24">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">
                En esta página
              </h5>
              <IndiceLinks />

              <div className="mt-8 border-t border-slate-100 pt-6 px-4">
                <p className="text-xs text-slate-400 mb-2">¿Dudas?</p>
                <a href="#" className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline">
                  Contactar Soporte &rarr;
                </a>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}