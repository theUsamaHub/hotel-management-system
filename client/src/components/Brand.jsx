export default function Brand({ emblem = false }) {
  return (
    <span className={`lsh-brand${emblem ? ' lsh-emblem' : ''}`}>
      <img src="/brand/luxury-star-mark.svg" width="44" height="44" alt={emblem ? 'Luxury Star Hotel' : ''} />
      {!emblem && <span className="lsh-wordmark">Luxury Star<small>HOTEL</small></span>}
    </span>
  );
}
