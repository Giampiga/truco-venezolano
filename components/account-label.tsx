export function AccountLabel({ handle }: { handle?: string }) {
  return (
    <small
      className="account-label"
      title={
        handle
          ? 'Perfil guardado y vinculado a una cuenta'
          : 'Este jugador todavía no ha creado su perfil'
      }
    >
      {handle ? `@${handle} · Perfil registrado` : 'Alias temporal'}
    </small>
  );
}
