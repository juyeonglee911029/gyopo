export default function PortalFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-frame relative z-10 flex min-w-0 flex-grow flex-col lg:pl-36">
      {children}
    </div>
  );
}
