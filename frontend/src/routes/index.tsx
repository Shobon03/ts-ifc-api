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

import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots: { x: number; y: number; size: number; originalSize: number }[] =
      [];
    const spacing = 25;
    let mouseX = -1000;
    let mouseY = -1000;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      dots.length = 0;

      // Criar efeito cascata - mais pontos no início, menos no final
      const cascadeLevels = Math.ceil(canvas.height / 150);

      for (let level = 0; level < cascadeLevels; level++) {
        const yStart = level * 150;
        const yEnd = Math.min((level + 1) * 150, canvas.height);

        // Reduzir densidade conforme desce (efeito cascata)
        const densityReduction = level * 0.3;
        const currentSpacing = spacing + spacing * densityReduction;

        // Número de colunas diminui conforme desce
        const columnsAtLevel = Math.max(
          1,
          Math.floor((canvas.width / currentSpacing) * (1 - level * 0.1)),
        );
        const columnSpacing = canvas.width / columnsAtLevel;

        for (let col = 0; col < columnsAtLevel; col++) {
          const x = col * columnSpacing + columnSpacing / 2;

          for (let y = yStart; y < yEnd; y += currentSpacing) {
            // Adicionar variação horizontal para efeito mais natural
            const xVariation = (Math.random() - 0.5) * 20;
            const yVariation = (Math.random() - 0.5) * 10;

            dots.push({
              x: x + xVariation,
              y: y + yVariation,
              size: 1.5,
              originalSize: 1.5,
            });
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      dots.forEach((dot) => {
        const distance = Math.sqrt(
          (dot.x - mouseX) ** 2 + (dot.y - mouseY) ** 2,
        );

        if (distance < 80) {
          const scale = 1 + (1 - distance / 80) * 3;
          dot.size = dot.originalSize * scale;
        } else {
          dot.size = dot.originalSize;
        }

        ctx.fillStyle =
          getComputedStyle(document.documentElement).getPropertyValue(
            '--dot-color',
          ) ||
          (document.documentElement.classList.contains('dark')
            ? '#6b7280'
            : '#d1d5db');
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    resizeCanvas();
    animate();

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className='relative min-h-screen overflow-hidden'>
      <canvas
        ref={canvasRef}
        className='absolute inset-0 pointer-events-auto z-2'
      />

      <div className='relative z-3 w-fit h-fit bg- flex flex-col items-center justify-center px-6 text-center xl:absolute xl:top-[50%] xl:transform-[translate(-50%,-50%)] xl:left-[50%] xl:z-2'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r text-primary dark:text-primary'>
            API de IFC
          </h1>

          <p className='text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300 leading-relaxed'>
            Plataforma de interoperabilidade para{' '}
            <span className='font-semibold text-blue-600 dark:text-blue-400'>
              Building Information Modeling
            </span>
          </p>

          <p className='text-lg mb-12 text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed'>
            Facilite a comunicação entre diferentes softwares BIM através do
            formato IFC. Converta modelos do Autodesk Revit e Graphisoft
            Archicad com precisão e eficiência.
          </p>

          <Link to='/model-generation'>
            <Button size='lg' variant='default'>
              Converter modelo para IFC
            </Button>
          </Link>

          <div className='mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto'>
            <div className='p-6 rounded-lg bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700'>
              <h3 className='text-xl font-semibold mb-3 text-gray-900 dark:text-white'>
                Revit (.rvt)
              </h3>
              <p className='text-gray-600 dark:text-gray-300'>
                Converta arquivos do Autodesk Revit para o formato IFC padrão
              </p>
            </div>
            <div className='p-6 rounded-lg bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700'>
              <h3 className='text-xl font-semibold mb-3 text-gray-900 dark:text-white'>
                Archicad (.pln)
              </h3>
              <p className='text-gray-600 dark:text-gray-300'>
                Transforme projetos do Graphisoft Archicad em IFC
              </p>
            </div>
            <div className='p-6 rounded-lg bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700'>
              <h3 className='text-xl font-semibold mb-3 text-gray-900 dark:text-white'>
                Validação
              </h3>
              <p className='text-gray-600 dark:text-gray-300'>
                Verifique a conformidade dos seus modelos IFC
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
