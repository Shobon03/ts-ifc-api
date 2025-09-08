/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className='min-h-screen'>
      {/* Hero Section */}
      <section className='relative bg-orange-50 dark:bg-gray-900 overflow-hidden'>
        {/* Geometric Shapes */}
        <div className='absolute inset-0'>
          {/* Left triangle */}
          <div className='absolute left-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-yellow-300/60 dark:bg-yellow-500/30 transform rotate-45 -translate-x-24'></div>

          {/* Right circle */}
          <div className='absolute right-0 top-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/40 dark:bg-yellow-500/20 rounded-full translate-x-36'></div>

          {/* Top right partial circle */}
          <div className='absolute right-0 top-0 w-48 h-48 bg-yellow-200/50 dark:bg-yellow-600/20 rounded-full translate-x-24 -translate-y-24'></div>
        </div>

        <div className='relative z-10 container mx-auto px-6 py-24'>
          <div className='max-w-4xl mx-auto text-center'>
            <h1 className='text-5xl md:text-7xl font-bold mb-8 text-gray-900 dark:text-white'>
              Um projeto de TCC para
              <span className='block text-primary dark:text-primary-foreground'>
                interoperabilidade BIM
              </span>
            </h1>

            <p className='text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed'>
              Esse projeto visa facilitar a conversão e manipulação de arquivos
              IFC, promovendo a interoperabilidade entre diferentes softwares
              BIM.
            </p>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <section className='py-20 bg-white dark:bg-gray-900'>
        <div className='container mx-auto px-6'>
          <div className='max-w-6xl mx-auto'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20'>
              <div>
                <h2 className='text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white'>
                  API RESTful em Typescript e Python
                </h2>
                <p className='text-lg mb-6 text-gray-700 dark:text-gray-300 leading-relaxed'>
                  Nossa API é construída com Typescript e Python e utiliza a
                  bibliotecas oficiais dos softwares Revit e Archicad para
                  comunicação e transformação de dados BIM.
                </p>
                <div className='space-y-4'>
                  <div className='flex items-center'>
                    <div className='w-2 h-2 bg-primary rounded-full mr-3'></div>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Transformação de modelos fechados em IFC
                    </span>
                  </div>
                  <div className='flex items-center'>
                    <div className='w-2 h-2 bg-primary rounded-full mr-3'></div>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Validação contra esquemas oficiais IFC
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-blue-50 dark:bg-gray-800 p-8 rounded-2xl'>
                <h3 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
                  Tecnologias Utilizadas
                </h3>
                <div className='space-y-3'>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Typescript && Python
                    </span>
                    <span className='px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm'>
                      Backend
                    </span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Fastify
                    </span>
                    <span className='px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm'>
                      Servidor
                    </span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Zod
                    </span>
                    <span className='px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm'>
                      Validação de schemas
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-16 items-center'>
              <div className='order-2 lg:order-1'>
                <div className='bg-orange-50 dark:bg-gray-800 p-8 rounded-2xl'>
                  <h3 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
                    Interface Moderna
                  </h3>
                  <div className='space-y-3'>
                    <div className='flex justify-between items-center'>
                      <span className='text-gray-700 dark:text-gray-300'>
                        React + TypeScript
                      </span>
                      <span className='px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-sm'>
                        Frontend
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-gray-700 dark:text-gray-300'>
                        TanStack Router
                      </span>
                      <span className='px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm'>
                        Routing
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-gray-700 dark:text-gray-300'>
                        Tailwind CSS
                      </span>
                      <span className='px-3 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded-full text-sm'>
                        Styling
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className='order-1 lg:order-2'>
                <h2 className='text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white'>
                  Frontend React
                </h2>
                <p className='text-lg mb-6 text-gray-700 dark:text-gray-300 leading-relaxed'>
                  Interface moderna e responsiva desenvolvida em React com
                  TypeScript. Utiliza o TanStack Router para gerenciamento de
                  rotas e se comunica com a API Python para fornecer uma
                  experiência intuitiva.
                </p>
                <div className='space-y-4'>
                  <div className='flex items-center'>
                    <div className='w-2 h-2 bg-primary rounded-full mr-3'></div>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Interface responsiva e acessível
                    </span>
                  </div>
                  <div className='flex items-center'>
                    <div className='w-2 h-2 bg-primary rounded-full mr-3'></div>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Suporte a modo escuro
                    </span>
                  </div>
                  <div className='flex items-center'>
                    <div className='w-2 h-2 bg-primary rounded-full mr-3'></div>
                    <span className='text-gray-700 dark:text-gray-300'>
                      Componentes reutilizáveis
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='py-20 bg-gray-50 dark:bg-gray-800'>
        <div className='container mx-auto px-6'>
          <div className='max-w-4xl mx-auto text-center mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white'>
              Recursos Principais
            </h2>
            <p className='text-xl text-gray-600 dark:text-gray-300'>
              Conjunto completo de ferramentas para trabalhar com arquivos IFC
            </p>
          </div>

          <div className='max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8'>
            <div className='bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
              <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-6'>
                <svg
                  className='w-6 h-6 text-blue-600 dark:text-blue-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v1m1 0h4m-4 0a2 2 0 012-2h2a2 2 0 012 2m0 0v1m0-1a2 2 0 012-2h2a2 2 0 012 2'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
                Conversão Revit
              </h3>
              <p className='text-gray-600 dark:text-gray-300 leading-relaxed'>
                Converta arquivos .rvt do Autodesk Revit para o formato IFC
                padrão com precisão e preservação de metadados.
              </p>
            </div>

            <div className='bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
              <div className='w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mb-6'>
                <svg
                  className='w-6 h-6 text-green-600 dark:text-green-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
                Suporte Archicad
              </h3>
              <p className='text-gray-600 dark:text-gray-300 leading-relaxed'>
                Transforme projetos .pln do Graphisoft Archicad em arquivos IFC
                compatíveis com outros softwares BIM.
              </p>
            </div>

            <div className='bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
              <div className='w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mb-6'>
                <svg
                  className='w-6 h-6 text-purple-600 dark:text-purple-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
                Validação IFC
              </h3>
              <p className='text-gray-600 dark:text-gray-300 leading-relaxed'>
                Verifique a conformidade dos seus modelos IFC com os esquemas
                oficiais e padrões da buildingSMART.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
