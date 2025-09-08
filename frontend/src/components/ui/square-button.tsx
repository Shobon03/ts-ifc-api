import type { HTMLAttributes } from 'react';

type SquareButtonProps = HTMLAttributes<HTMLButtonElement>;
type SquareLinkButtonProps = HTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

function SquareLinkButton({ children, ...rest }: SquareLinkButtonProps) {
  return (
    <a
      className='p-2 flex rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer'
      target='_blank'
      rel='noopener noreferrer'
      {...rest}
    >
      {children}
    </a>
  );
}

function SquareButton({ children, ...rest }: SquareButtonProps) {
  return (
    <button
      type='button'
      className='p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer'
      {...rest}
    >
      {children}
    </button>
  );
}

export { SquareButton, SquareLinkButton };
