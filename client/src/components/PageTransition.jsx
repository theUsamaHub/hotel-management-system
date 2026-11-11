export default function PageTransition({ children }) {
  // Keep the route tree mounted during navigation. A pathname key here would
  // recreate the workspace shell and expose the top-level lazy-loading fallback.
  return (
    <div className="page-transition">
      {children}
    </div>
  );
}
