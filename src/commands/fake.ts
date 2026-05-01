import { Env } from "../types";
import { sendMessage } from "../utils/telegram";
import { faker, fakerEN_US, fakerEN_GB } from "@faker-js/faker";

export async function handleFake(args: string[], chatId: number, env: Env): Promise<void> {
  const countryCode = (args[0] || "us").toLowerCase();
  
  let localeFaker = fakerEN_US;
  let flag = "🇺🇸";
  let countryName = "United States";

  if (countryCode === "gb" || countryCode === "uk") {
    localeFaker = fakerEN_GB;
    flag = "🇬🇧";
    countryName = "United Kingdom";
  }

  const name = localeFaker.person.fullName();
  const gender = localeFaker.person.sex();
  const street = localeFaker.location.streetAddress();
  const city = localeFaker.location.city();
  const state = localeFaker.location.state();
  const zip = localeFaker.location.zipCode();
  const phone = localeFaker.phone.number();

  const response = `📍 <b>Address For ${flag} ${countryName}</b>
———————————————
• <b>Name</b> : ${name}
• <b>Gender</b> : ${gender.charAt(0).toUpperCase() + gender.slice(1)}
• <b>Street Address</b> : ${street}
• <b>City/Town/Village</b> : ${city}
• <b>State</b> : ${state}
• <b>Postal Code</b> : ${zip}
• <b>Country</b> : ${countryName}
• <b>Phone</b> : <code>${phone}</code>`;

  await sendMessage(env, chatId, response);
}
