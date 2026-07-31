import { TabBar } from '@/components/TabBar';

// Authenticated shell: content + the floating pill tab bar with the
// always-available yellow "add a routine" FAB in the middle.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-md flex-1 px-[26px] pb-32 pt-6">{children}</div>
      <TabBar />
    </div>
  );
}
