import { faker, fakerEN_US, fakerEN_GB } from '@faker-js/faker';

export async function handleFakeCommand(text: string): Promise<string> {
  // Extract optional locale argument: `/fake us` or `/fake gb`
  const args = text.replace(/^\/fake\s*/i, '').trim().toLowerCase();
  
  // High-level locale routing
  let localizedFaker = faker; 
  let localeFlag = "🌐 Global";

  if (args === 'us') {
    localizedFaker = fakerEN_US;
    localeFlag = "🇺🇸 United States";
  } else if (args === 'gb' || args === 'uk') {
    localizedFaker = fakerEN_GB;
    localeFlag = "🇬🇧 United Kingdom";
  }

  const gender = localizedFaker.person.sexType();
  const firstName = localizedFaker.person.firstName(gender);
  const lastName = localizedFaker.person.lastName();
  const dob = localizedFaker.date.birthdate({ min: 18, max: 65, mode: 'age' });

  return `
🪪 **Secure Identity Generator**
🌍 **Locale:** ${localeFlag}

👤 **Personal Info:**
**Name:** ${firstName} ${lastName}
**Gender:** ${gender.charAt(0).toUpperCase() + gender.slice(1)}
**DOB:** ${dob.toISOString().split('T')[0]}

📍 **Address Data:**
**Street:** ${localizedFaker.location.streetAddress()}
**City:** ${localizedFaker.location.city()}
**State/Region:** ${localizedFaker.location.state()}
**Zip/Postal:** \`${localizedFaker.location.zipCode()}\`
**Country:** ${localizedFaker.location.country()}

📱 **Contact & Digital:**
**Phone:** \`${localizedFaker.phone.number()}\`
**Email:** \`${localizedFaker.internet.email({ firstName, lastName })}\`
**Password:** \`${localizedFaker.internet.password({ length: 14, memorable: true })}\`
  `.trim();
}
