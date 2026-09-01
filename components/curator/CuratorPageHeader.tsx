import { Box, Flex, Text, Title } from "@mantine/core";

type CuratorPageHeaderProps = {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function CuratorPageHeader({ title, description, meta, actions, className }: CuratorPageHeaderProps) {
  return <Flex component="header" justify="space-between" align="center" gap="xl" wrap="wrap" className={["curator-page-header", className].filter(Boolean).join(" ")}>
    <Box className="curator-page-header-copy">
      {meta ? <div className="curator-page-header-meta">{meta}</div> : null}
      <Title order={1}>{title}</Title>
      {description ? <Text c="dimmed">{description}</Text> : null}
    </Box>
    {actions ? <div className="curator-page-header-actions">{actions}</div> : null}
  </Flex>;
}
