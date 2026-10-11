// Starting data, loaded once on the first visit (when nothing is saved in the browser yet).
const THREE_SUM = `class Solution {
    public List<List<Integer>> threeSum(int[] arr) {
        List<List<Integer>> res = new ArrayList<List<Integer>>();
        int n = arr.length;
        Arrays.sort(arr);
        for (int i = 0; i < n - 2; i++) {
            if (i > 0 && arr[i] == arr[i - 1]) {
                continue;
            } else {
                int j = i + 1;
                int k = arr.length - 1;
                while (j < k) {
                    int sum = arr[i] + arr[j] + arr[k];
                    if (sum == 0) {
                        ArrayList<Integer> temp = new ArrayList<Integer>();
                        temp.add(arr[i]);
                        temp.add(arr[j]);
                        temp.add(arr[k]);
                        res.add(temp);
                        while (j < k && arr[j] == arr[j + 1]) j++;
                        while (j < k && arr[k] == arr[k - 1]) k--;
                        j++;
                        k--;
                    } else if (sum > 0) {
                        k--;
                    } else {
                        j++;
                    }
                }
            }
        }
        return res;
    }
}`;

const base = { link: "", notes: "", solution: "", redo: false, redoOn: null, redoCount: 0, lastRedoneOn: null };

export const SEED = [
  { ...base, id: "seed-contains-duplicate", name: "Contains Duplicate", pattern: "Hash Set", difficulty: "Easy",
    link: "https://leetcode.com/problems/contains-duplicate/", solvedOn: "2026-10-05", createdAt: 1 },
  { ...base, id: "seed-valid-anagram", name: "Valid Anagram", pattern: "Hash Map", difficulty: "Easy",
    link: "https://leetcode.com/problems/valid-anagram/", solvedOn: "2026-10-05", redoCount: 1, lastRedoneOn: "2026-10-06", createdAt: 2 },
  { ...base, id: "seed-two-sum", name: "Two Sum", pattern: "Hash Map", difficulty: "Easy",
    link: "https://leetcode.com/problems/two-sum/", solvedOn: "2026-10-05", redoCount: 1, lastRedoneOn: "2026-10-06", createdAt: 3,
    notes: "HashMap: value -> index. For each number check if (target - num) is already in the map, then put num. Check first, then put." },
  { ...base, id: "seed-product-except-self", name: "Product of Array Except Self", pattern: "Prefix / Suffix", difficulty: "Medium",
    link: "https://leetcode.com/problems/product-of-array-except-self/", solvedOn: "2026-10-07", redo: true, redoOn: "2026-10-10", createdAt: 4,
    notes: "Answer[i] = product of everything left of i times product of everything right of i. Build left products, then right products, multiply. O(n) time." },
  { ...base, id: "seed-valid-sudoku", name: "Valid Sudoku", pattern: "Hash Set", difficulty: "Medium",
    link: "https://leetcode.com/problems/valid-sudoku/", solvedOn: "2026-10-08", redo: true, redoOn: "2026-10-11", createdAt: 5,
    notes: "One pass over the 9x9 board. Keep a set per row, per column and per 3x3 box. Box index = (i/3)*3 + (j/3). If a digit is already in any of its three sets, the board is invalid." },
  { ...base, id: "seed-three-sum", name: "3Sum", pattern: "Two Pointers", difficulty: "Medium",
    link: "https://leetcode.com/problems/3sum/", solvedOn: "2026-10-11", redo: true, redoOn: "2026-10-14", createdAt: 6,
    notes: "Sort first. Fix i, then run Two Sum II with j = i+1 and k = n-1 looking for sum 0.\nsum > 0: k--. sum < 0: j++. sum == 0: save the triplet, skip duplicate j and k, then j++ and k--.\nSkip duplicate i with: if (i > 0 && arr[i] == arr[i-1]) continue.\nTime O(n^2), space O(1) extra.",
    solution: THREE_SUM },
];
