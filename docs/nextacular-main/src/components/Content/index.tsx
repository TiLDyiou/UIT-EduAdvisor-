import type { FC, ReactNode } from 'react';

type ContentProps = { children: ReactNode };
type ContentContainerProps = { children: ReactNode };
type ContentDividerProps = { thick?: boolean };
type ContentEmptyProps = { children: ReactNode };
type ContentTitleProps = { subtitle?: ReactNode; title: ReactNode };

type ContentComponent = FC<ContentProps> & {
  Container: FC<ContentContainerProps>;
  Divider: FC<ContentDividerProps>;
  Empty: FC<ContentEmptyProps>;
  Title: FC<ContentTitleProps>;
};

const Content: ContentComponent = (({ children }: ContentProps) => (
  <div className="flex flex-col h-full p-5 space-y-5 overflow-y-auto md:p-10 md:w-3/4">
    {children}
  </div>
)) as ContentComponent;

const ContentContainer: FC<ContentContainerProps> = ({ children }) => (
  <div className="flex flex-col pb-10 space-y-5">{children}</div>
);
ContentContainer.displayName = 'Content.Container';

const ContentDivider: FC<ContentDividerProps> = ({ thick }) =>
  thick ? (
    <hr className="border-2 dark:border-gray-600" />
  ) : (
    <hr className="border dark:border-gray-700" />
  );
ContentDivider.displayName = 'Content.Divider';

const ContentEmpty: FC<ContentEmptyProps> = ({ children }) => (
  <div>
    <div className="flex items-center justify-center p-5 bg-gray-100 border-4 border-dashed rounded">
      <p>{children}</p>
    </div>
  </div>
);
ContentEmpty.displayName = 'Content.Empty';

const ContentTitle: FC<ContentTitleProps> = ({ subtitle, title }) => (
  <div>
    <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
    <h3 className="text-gray-400">{subtitle}</h3>
  </div>
);
ContentTitle.displayName = 'Content.Title';

Content.Container = ContentContainer;
Content.Divider = ContentDivider;
Content.Empty = ContentEmpty;
Content.Title = ContentTitle;
Content.displayName = 'Content';

export default Content;
