import { describe, it, expect } from "vitest";
import { validateCustomer, inferAddressCountry } from "../../supabase/functions/_shared/customer-validation";

const ok = { firstName: "Anna", lastName: "Müller-Schmidt", email: "anna@example.de", phone: "0160 5652154",
  street: "Hauptstraße", houseNumber: "12a", postalCode: "50667", city: "Köln" };
const v = (o: Partial<typeof ok>, cc = "DE") => validateCustomer({ ...ok, ...o }, cc);

describe("customer/address validation (shared by form + create-payment)", () => {
  it("1 valid complete address → accept", () => expect(v({})).toEqual([]));
  it("2 missing street → reject", () => expect(v({ street: "" })).toContain("street"));
  it("3 missing house number → reject", () => expect(v({ houseNumber: "" })).toContain("houseNumber"));
  it("4 invalid postcode → reject", () => {
    expect(v({ postalCode: "123" })).toContain("postalCode");
    expect(v({ postalCode: "00000" })).toContain("postalCode");
  });
  it("5 obviously fake address → reject", () => {
    for (const street of ["asdf", "123", "test address", "Teststraße", "qwertz", "xxxxx", "sdfghj"])
      expect(v({ street })).toContain("street");
    expect(v({ city: "test" })).toContain("city");
    expect(v({ firstName: "asdf" })).toContain("firstName");
  });
  it("6 city/postcode mismatch → reject", () => expect(v({ city: "Düsseldorf", postalCode: "50667" })).toContain("cityPostalMismatch"));
  it("7 invalid phone → reject", () => {
    for (const phone of ["123", "abc", "0000000000", "12345"]) expect(v({ phone })).toContain("phone");
    expect(v({ phone: "+49 160 5652154" })).toEqual([]);
  });
  it("8 invalid email → reject", () => {
    for (const email of ["a@b", "foo", "x@y.c", "a..b@x.de"]) expect(v({ email })).toContain("email");
  });
  it("9 valid international address → accept", () => {
    expect(validateCustomer({ ...ok, street: "Rue de Rivoli", postalCode: "75001", city: "Paris", phone: "+33 1 42 60 30 30" }, "FR")).toEqual([]);
    expect(validateCustomer({ ...ok, street: "Baker Street", houseNumber: "221", postalCode: "NW1 6XE", city: "London", phone: "+44 20 7946 0958" }, inferAddressCountry("NW1 6XE"))).toEqual([]);
    expect(validateCustomer({ ...ok, firstName: "José", lastName: "O'Neil", street: "Straße des 17. Juni", houseNumber: "135", postalCode: "10623", city: "Berlin" }, "DE")).toEqual([]);
    expect(validateCustomer({ ...ok, firstName: "محمد", lastName: "علي", street: "شارع التحرير", postalCode: "11511", city: "القاهرة", phone: "+20 100 123 4567" }, "EG")).toEqual([]);
  });
});
