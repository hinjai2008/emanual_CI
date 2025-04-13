export interface Test {
    id: number;
    full_name: string;
    GCRS_name: string;
    label_name: string;
    form: string;
    hospital: string;
    requirement: string;
    container: string;
    indication: string;
    turn_around_time: string;
    synonyms: string[];
    alert: string[];
    last_updated: string;
}

export const tests: Test[] = [
    {
        id: 1,
        full_name: 'Potassium',
        GCRS_name: 'Potassium',
        label_name: 'K',
        form: 'GCRS',
        hospital: 'CMC Core Lab',
        requirement: 'Deliver to CMC Core within four hours after collection',
        container: '4mL Heparin blood',
        indication: '',
        turn_around_time: '????',
        synonyms: ['',],
        alert: [],
        last_updated: '2023-10-01',
    },

    {
        id: 2,
        full_name: 'Anti-Cardiolipin antibodies',
        GCRS_name: 'Anti-Cardiolipin antibodies',
        label_name: 'ACL-IgG',
        form: 'GCRS',
        hospital: 'PMH Haem Lab',
        requirement: '',
        container: '4mL clotted blood',
        indication: "Suspicion of antiphospholipid syndrome",
        turn_around_time: '????',
        synonyms: ['Antiphospholipid antibodies',],
        alert: [],
        last_updated: '2023-10-01',
    },

    {
        id: 3,
        full_name: '5-Hydrxyindoleacetic acid',
        GCRS_name: '5-Hydrxyindoleacetic acid',
        label_name: '5-HIAA',
        form: 'GCRS',
        hospital: 'PMH Chem Lab',
        requirement: 'Advance arrangement with Core Lab via 7737. \nBananas, pineapples, eggplant, tomatoes, plums and walnuts must be excluded from diet 1 day prior to specimen collection. Phenothiazines should likewise be discounted.',
        container: "light-protected 24 hours urine container, with HCl (≥18y); \n30 mL spot urine in light-protected plain bottle for children",
        indication: "Diagnosing and Monitoring carcinoid tumors",
        turn_around_time: '????',
        synonyms: ['5HIAA',],
        alert: ['CONTAINER', 'BOOK'],
        last_updated: '2023-10-01',
    },

    {
        id: 4,
        full_name: 'Beta-hydroxybutyrate',
        GCRS_name: 'Beta-hydroxybutyrate',
        label_name: 'Beta-Hb',
        form: 'GCRS',
        hospital: 'PMH Chem Lab',
        requirement: 'On-Ice transport. Send specimen to CMC Core Lab immediately. Do not freeze.',
        container: "4mL Heparin blood",
        indication: "Investigation of metabolic acidosis with an increased anion gap, investigation of hypoglycaemia and metabolic diseases.",
        turn_around_time: '????',
        synonyms: ['diabetic ketoacidosis', 'ketones', 'ketosis',],
        alert: ['URGENT', 'ICE',],
        last_updated: '2023-10-01',
    },

    {
        id: 5,
        full_name: 'Anti-Thyroid Stimulating Hormone Receptor antibodies',
        GCRS_name: 'Form',
        label_name: 'Anti-TSHR, Form',
        form: 'QMH Immunology Form',
        hospital: 'QMH Immunology Lab',
        requirement: '',
        container: '4mL clotted blood',
        indication: "",
        turn_around_time: '????',
        synonyms: ['anti-thyroid antibodies',],
        alert: ['FORM',],
        last_updated: '2023-10-01',
    },

    {
        id: 6,
        full_name: 'Cytomegalovirus pp65 antigen',
        GCRS_name: 'CMV pp65 antigen',
        label_name: 'CMV pp65',
        form: 'GCRS',
        hospital: 'QMH Mic Lab',
        requirement: 'Fresh Specimens reach to CMC core lab before 9:30 am on weekdays. No service on Saturdays, Sundays and public holidays.',
        container: '2x 4mL EDTA blood',
        indication: "CMV disease in immunocompromised patients; monitoring CMV disease progress",
        turn_around_time: '????',
        synonyms: ['',],
        alert: ['TIME',],
        last_updated: '2023-10-01',
    },

    {
        id: 7,
        full_name: 'Cytomegalovirus poymerase chain reaction',
        GCRS_name: 'CMV PCR, quantitative',
        label_name: 'CMV PCR',
        form: 'GCRS',
        hospital: 'QMH Mic Lab',
        requirement: 'Fresh Specimens reach to CMC core lab before 9:30 am on weekdays. No service on Saturdays, Sundays and public holidays.',
        container: '2x 4mL EDTA blood',
        indication: "CMV disease in immunocompromised patients; monitoring CMV disease progress",
        turn_around_time: '????',
        synonyms: ['',],
        alert: ['TIME',],
        last_updated: '2023-10-01',
    },

    {
        id: 8,
        full_name: 'E-manual Testing',
        GCRS_name: 'Testing',
        label_name: 'Testing',
        form: 'GCRS',
        hospital: 'CMC Core Lab',
        requirement: 'Fresh Specimens reach to CMC core lab before 9:30 am on weekdays. No service on Saturdays, Sundays and public holidays.',
        container: '4mL clotted blood',
        indication: "",
        turn_around_time: '????',
        synonyms: ['',],
        alert: ['TIME', 'URGENT', 'ICE', 'FORM', 'BOOK', 'CONTAINER',],
        last_updated: '2023-10-01',
    },
];

// Utility function to find duplicate IDs
export function findDuplicateIds(tests: Test[]): number[] {
    const ids = tests.map(test => test.id);
    const duplicates: number[] = [];
    const seen = new Set<number>();

    for (const id of ids) {
        if (seen.has(id)) {
            duplicates.push(id);
        } else {
            seen.add(id);
        }
    }

    return [...new Set(duplicates)]; // Ensure duplicates are unique
}

// Example usage: Validate the `tests` array
// const duplicateIds = findDuplicateIds(tests);
// if (duplicateIds.length > 0) {
//     console.error("Duplicate IDs found in the tests array:", duplicateIds);
// }