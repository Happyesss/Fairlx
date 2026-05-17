"use client";



interface StandaloneLayoutProps {
  children: React.ReactNode;
}

const StandaloneLayout = ({ children }: StandaloneLayoutProps) => {
  return (
    <main className="bg-background min-h-screen">
      {children}
    </main>
  );
};

export default StandaloneLayout;
