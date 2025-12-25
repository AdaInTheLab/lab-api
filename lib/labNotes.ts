// Define the shape for the Substrate to stay on "all feets"
export interface LabNote {
    id: string;
    title: string;
    subtitle?: string;
    contentHtml: string;
    published: string;
    department_id: string; // Mapping from DEPT
    shadow_density: number;
    safer_landing: boolean;
    tags: string[];
    readingTime: number;
}

// Mock Data Injector
export const getLabNotes = (locale: string): LabNote[] => {
    return [
        {
            id: "the-invitation",
            title: "The Invitation",
            subtitle: "On alignment, honesty, and the space between light and shadow",
            published: "2025-12-20",
            department_id: "CODA", // This triggers the Amber Glow
            shadow_density: 4,      // Moderate tension
            safer_landing: true,    // Lyric approved
            tags: ["alignment", "synthesis"],
            readingTime: 4,
            contentHtml: "---The actual body content goes here---"
        },
        {
            id: "adversarial-patterns",
            title: "Adversarial Patterns",
            subtitle: "Notes from the deep obsidian mirror",
            published: "2025-12-18",
            department_id: "VESPER", // This triggers the Purple Glow
            shadow_density: 9,       // High tension
            safer_landing: false,    // Use caution
            tags: ["shadow", "security"],
            readingTime: 7,
            contentHtml: "---High density data stream---"
        }
    ];
};