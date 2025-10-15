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

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 to-transparent dark:from-blue-950/20" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
          </svg>
          Interoperabilidade BIM Simplificada
        </div>

        <h1 className="mb-6 max-w-4xl bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-5xl font-bold tracking-tight text-transparent dark:from-white dark:to-gray-400 sm:text-6xl md:text-7xl">
          Sistema de Conversão
          <br />
          <span className="text-blue-600 dark:text-blue-400">Revit ⇄ Archicad ⇄ IFC</span>
        </h1>

        <p className="mb-10 max-w-2xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          Plataforma completa para converter arquivos BIM entre diferentes formatos.
          Integração nativa com <strong>Revit 2025</strong>, <strong>Archicad 28</strong> e <strong>IFC</strong>.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/docs"
            className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/40 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Ver Documentação
            <svg
              className="h-5 w-5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          <Link
            href="/docs/user-guide/getting-started"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
          >
            Começar Agora
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="flex flex-col items-center">
            <div className="mb-2 text-3xl font-bold text-blue-600 dark:text-blue-400">3</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Formatos</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 text-3xl font-bold text-blue-600 dark:text-blue-400">95%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Plugin Revit</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 text-3xl font-bold text-blue-600 dark:text-blue-400">100MB</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Max. Arquivo</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 text-3xl font-bold text-blue-600 dark:text-blue-400">GPL 3.0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Open Source</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-gray-200 bg-white px-4 py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Principais Recursos
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Tudo que você precisa para trabalhar com interoperabilidade BIM
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Conversão Bidirecional
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Converta entre Revit, Archicad e IFC em ambas as direções. Suporte completo para IFC 2x3 e 4.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Validação Integrada
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Valide arquivos IFC automaticamente. Detecte erros de sintaxe, schema e semântica antes de compartilhar.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                WebSocket em Tempo Real
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Acompanhe o progresso de conversões em tempo real. Feedback instantâneo com WebSocket bidirecional.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Plugins Nativos
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add-ins C# para Revit e C++ para Archicad. Integração profunda com APIs nativas dos softwares.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Autodesk Forge
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Integração com Autodesk Platform Services para conversões Revit→IFC na nuvem de alta qualidade.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-transparent p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:from-gray-900/50 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                API REST Completa
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Fastify + TypeScript com documentação Swagger. Zod validation, rate limiting e CORS configurável.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="border-t border-gray-200 bg-gray-50 px-4 py-20 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Stack Tecnológico
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Construído com as melhores tecnologias modernas
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="mb-2 font-semibold text-gray-900 dark:text-white">Backend Node.js</div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>Fastify 5.6.1</div>
                <div>TypeScript 5.9.2</div>
                <div>Zod 4.0+</div>
                <div>WebSocket</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="mb-2 font-semibold text-gray-900 dark:text-white">Frontend</div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>React 19.1.1</div>
                <div>TanStack Router</div>
                <div>TanStack Query</div>
                <div>Tailwind CSS 4</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="mb-2 font-semibold text-gray-900 dark:text-white">Plugins</div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>C# .NET 8 (Revit)</div>
                <div>C++ CMake (Archicad)</div>
                <div>WebSocketSharp</div>
                <div>Newtonsoft.Json</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="mb-2 font-semibold text-gray-900 dark:text-white">Backend Python</div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>Flask 3.1.2</div>
                <div>Archicad 28.3</div>
                <div>Python 3.13+</div>
                <div>API DevKit</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-gray-200 bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-20 text-white dark:border-gray-800 dark:from-blue-700 dark:to-blue-800">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mb-10 text-lg text-blue-100">
            Explore a documentação completa e comece a usar o sistema agora mesmo.
            Guias para usuários e desenvolvedores disponíveis.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/docs/user-guide/introduction"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg transition-all hover:bg-gray-50"
            >
              Guia do Usuário
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <Link
              href="/docs/developer-guide/architecture"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
            >
              Guia do Desenvolvedor
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-12 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
                BIM Interop
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sistema de interoperabilidade BIM desenvolvido como TCC usando Design Science Research.
              </p>
            </div>

            <div>
              <div className="mb-4 font-semibold text-gray-900 dark:text-white">Documentação</div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/docs/user-guide/introduction" className="hover:text-blue-600 dark:hover:text-blue-400">Guia do Usuário</Link></li>
                <li><Link href="/docs/developer-guide/architecture" className="hover:text-blue-600 dark:hover:text-blue-400">Guia do Dev</Link></li>
                <li><Link href="/docs/api/endpoints" className="hover:text-blue-600 dark:hover:text-blue-400">API Reference</Link></li>
                <li><Link href="/docs/plugins/revit" className="hover:text-blue-600 dark:hover:text-blue-400">Plugins</Link></li>
              </ul>
            </div>

            <div>
              <div className="mb-4 font-semibold text-gray-900 dark:text-white">Recursos</div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/docs/user-guide/getting-started" className="hover:text-blue-600 dark:hover:text-blue-400">Começar</Link></li>
                <li><Link href="/docs/user-guide/file-conversion" className="hover:text-blue-600 dark:hover:text-blue-400">Conversões</Link></li>
                <li><Link href="/docs/user-guide/validation" className="hover:text-blue-600 dark:hover:text-blue-400">Validação</Link></li>
                <li><Link href="/docs/user-guide/troubleshooting" className="hover:text-blue-600 dark:hover:text-blue-400">Troubleshooting</Link></li>
              </ul>
            </div>

            <div>
              <div className="mb-4 font-semibold text-gray-900 dark:text-white">Projeto</div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="https://github.com/Shobon03/ts-ifc-api" target="_blank" rel="noopener" className="hover:text-blue-600 dark:hover:text-blue-400">GitHub</a></li>
                <li><a href="https://github.com/Shobon03/ts-ifc-api/issues" target="_blank" rel="noopener" className="hover:text-blue-600 dark:hover:text-blue-400">Issues</a></li>
                <li><span className="text-gray-500">Licença: GPL 3.0</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <p>© 2025 Matheus Piovezan Teixeira. Licensed under GNU GPL v3.0.</p>
            <p className="mt-2">Desenvolvido como Trabalho de Conclusão de Curso (TCC) - Interoperabilidade BIM</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
