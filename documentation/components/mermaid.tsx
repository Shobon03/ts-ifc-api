'use client';

import { useEffect, useRef } from 'react';

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!ref.current) return;

      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad: true,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1890ff',
            primaryTextColor: '#fff',
            primaryBorderColor: '#1890ff',
            lineColor: '#1890ff',
            secondaryColor: '#52c41a',
            tertiaryColor: '#fff2f0',
            background: '#141414',
            mainBkg: '#1f1f1f',
            secondBkg: '#2a2a2a',
            textColor: '#ffffff',
            border1: '#404040',
            border2: '#404040',
          },
        });

        const id = `mermaid-${Math.random().toString(36).substring(7)}`;
        const { svg } = await mermaid.render(id, chart);

        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (error) {
        console.error('Failed to render Mermaid diagram:', error);
        if (ref.current) {
          ref.current.innerHTML = `<pre><code>${chart}</code></pre>`;
        }
      }
    };

    renderDiagram();
  }, [chart]);

  return <div ref={ref} className="my-6 flex justify-center" />;
}
