import Content from '@/components/Content/index';
import Meta from '@/components/Meta/index';
import { AccountLayout } from '@/layouts/index';
import { useWorkspace } from '@/providers/workspace';

const Workspace = () => {
  const { workspace } = useWorkspace();

  if (!workspace) return null;

  return (
    <AccountLayout>
      <Meta title={`Nextacular - ${workspace.name} | Dashboard`} />
      <Content.Title
        title={workspace.name}
        subtitle="This is your project's workspace"
      />
      <Content.Divider />
      <Content.Container>
        <span />
      </Content.Container>
    </AccountLayout>
  );
};

export default Workspace;
