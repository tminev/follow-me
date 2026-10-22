export function canUseLocation(user: { declaredAdult: boolean; dateOfBirth: Date }, now = new Date()) {
  let age = now.getUTCFullYear() - user.dateOfBirth.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < user.dateOfBirth.getUTCMonth() || (now.getUTCMonth() === user.dateOfBirth.getUTCMonth() && now.getUTCDate() < user.dateOfBirth.getUTCDate());
  if (beforeBirthday) age--;
  return user.declaredAdult && age >= 18;
}

export function approximateCoordinate(value: number) { return Math.round(value * 100) / 100; }

