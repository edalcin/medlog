package models

import "strings"

func inClause(n int) string {
	if n == 0 {
		return "(NULL)"
	}
	return "(?" + strings.Repeat(",?", n-1) + ")"
}

func anySlice(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}
