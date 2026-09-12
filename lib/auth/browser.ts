import { createBrowserClient } from '@supabase/ssr';
export const authConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
export function browserAuth() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export function authErrorMessage(cause: unknown) {
  const code =
    cause && typeof cause === 'object' && 'code' in cause ? cause.code : '';
  switch (code) {
    case 'email_not_confirmed':
      return 'Confirma tu correo antes de iniciar sesión. Revisa también la carpeta de correo no deseado.';
    case 'invalid_credentials':
      return 'El correo o la contraseña no son correctos.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Has hecho varios intentos seguidos. Espera un momento antes de volver a intentarlo.';
    case 'anonymous_provider_disabled':
      return 'El acceso como invitado todavía no está habilitado. Puedes practicar con Truquito sin una cuenta.';
    case 'provider_disabled':
    case 'email_provider_disabled':
    case 'signup_disabled':
      return 'Esta opción de acceso todavía no está habilitada. Prueba otra opción disponible.';
    case 'manual_linking_disabled':
      return 'Todavía no se puede vincular este proveedor a tu invitado. Puedes crear tu cuenta por correo.';
    case 'identity_already_exists':
    case 'email_exists':
    case 'user_already_exists':
      return 'Ese acceso ya pertenece a una cuenta. Usa «Ya tengo una cuenta» para entrar; las partidas de invitado no se transfieren a otra cuenta.';
    case 'weak_password':
      return 'Elige una contraseña más segura, de al menos 8 caracteres.';
    case 'same_password':
      return 'Elige una contraseña diferente de la anterior.';
    default:
      return 'No se pudo completar la solicitud. Revisa tus datos o inténtalo de nuevo.';
  }
}
