export function randomProfilePicture(name) {
    return `https://api.dicebear.com/9.x/initials/svg?seed=${name}`;
}