package repository

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
)

var (
	// ErrEmailTaken is returned when an email address is already registered.
	ErrEmailTaken = errors.New("an account with this email already exists")
	// ErrInvalidPosition is returned when a playlist track move is out of range.
	ErrInvalidPosition = errors.New("position out of range")
)

// ensureCascadeFK adds `table.column -> refTable(id) ON DELETE CASCADE` unless a
// foreign key between the two tables already exists (for example one created by an
// older infra/postgres/init.sql). GORM AutoMigrate only creates constraints for
// declared relations, so without this deleting a user would leave their data behind.
// Identifiers are compile-time constants, never user input.
func ensureCascadeFK(db *gorm.DB, table, column, refTable string) error {
	var n int64
	err := db.Raw(`
		SELECT COUNT(*) FROM pg_constraint c
		JOIN pg_class t ON t.oid = c.conrelid
		JOIN pg_class r ON r.oid = c.confrelid
		WHERE c.contype = 'f' AND t.relname = ? AND r.relname = ?`, table, refTable).Scan(&n).Error
	if err != nil || n > 0 {
		return err
	}
	stmt := fmt.Sprintf(`ALTER TABLE %q ADD CONSTRAINT %q FOREIGN KEY (%q) REFERENCES %q(id) ON DELETE CASCADE`,
		table, "fk_"+table+"_"+column, column, refTable)
	return db.Exec(stmt).Error
}
