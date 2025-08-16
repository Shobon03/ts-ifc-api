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

import { Block, CodeBlock, parseProps } from 'codehike/blocks';
import { highlight, Pre, type RawCode } from 'codehike/code';
import {
  Selectable,
  Selection,
  SelectionProvider,
} from 'codehike/utils/selection';
import { z } from 'zod';

import { tokenTransitions } from '@/components/annotations/token-transitions';
import { wordWrap } from './annotations/word-wrap';

const Schema = Block.extend({
  steps: z.array(Block.extend({ code: CodeBlock })),
});

export function Scrollycoding(props: unknown) {
  const { steps } = parseProps(props, Schema) as {
    steps: Array<{ title: string; children: any; code: any }>;
  };
  return (
    <SelectionProvider className='flex gap-4'>
      <div className='flex-1 mt-32 mb-[90vh] ml-2 prose min-w-60'>
        {steps.map((step, i) => (
          <Selectable
            key={i}
            index={i}
            selectOn={['click', 'scroll']}
            className='border-l-4 data-[selected=true]:border-blue-400 px-5 py-2 mb-24 rounded bg-card'
          >
            <h2 className='mt-4 text-xl'>{step.title}</h2>
            <div>{step.children}</div>
          </Selectable>
        ))}
      </div>
      <div className='w-1/2 bg-card'>
        <div className='top-16 sticky overflow-auto'>
          <Selection
            from={steps.map((step) => (
              <Code
                key={`${step.title.toLowerCase()}_code`}
                codeblock={step.code}
              />
            ))}
          />
        </div>
      </div>
    </SelectionProvider>
  );
}

async function Code({ codeblock }: { codeblock: RawCode }) {
  const highlighted = await highlight(codeblock, 'github-from-css');
  return (
    <Pre
      code={highlighted}
      handlers={[tokenTransitions, wordWrap]}
      className='min-h-[40rem]'
    />
  );
}
